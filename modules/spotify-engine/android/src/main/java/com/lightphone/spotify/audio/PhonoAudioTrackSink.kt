package com.lightphone.spotify.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.util.Log
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicInteger

/**
 * Android [AudioTrack] output for the librespot engine.
 *
 * The Rust drain thread (rust/spotify-core/src/audio_sink_jni.rs) calls these
 * static methods over JNI: it decodes to interleaved 16-bit stereo PCM, copies
 * each chunk into the direct [ByteBuffer] handed out by [prepareDirectBuffer],
 * then calls [writePcmDirect]. Every method name/signature here must match the
 * `call_static_method` calls in that file exactly.
 *
 * Lifecycle calls (start/stop/flush/pause/resume/recreate/release) come from
 * the player thread; [writePcmDirect] comes from the drain thread. Lifecycle
 * transitions are serialised on [lifecycleLock]; the hot write path reads the
 * track through a volatile and never blocks on that lock.
 */
object PhonoAudioTrackSink {
  private const val TAG = "PhonoAudioSink"
  private const val FALLBACK_MIN_BUFFER = 8192
  private const val TARGET_BUFFER_BYTES = 32_768

  private val ERROR_DEAD = AudioTrack.ERROR_DEAD_OBJECT
  private val ERROR_GENERIC = AudioTrack.ERROR

  private val lifecycleLock = Any()

  @Volatile private var track: AudioTrack? = null
  private var sampleRate = 44_100
  private var channels = 2

  private val writeErrors = AtomicInteger(0)
  private val deadObjects = AtomicInteger(0)
  private val routingEvents = AtomicInteger(0)

  @JvmStatic
  fun prepareDirectBuffer(capacity: Int): ByteBuffer? =
    try {
      ByteBuffer.allocateDirect(capacity)
    } catch (error: Throwable) {
      Log.e(TAG, "allocateDirect($capacity) failed", error)
      null
    }

  @JvmStatic
  fun start(requestedSampleRate: Int, requestedChannels: Int): Boolean =
    synchronized(lifecycleLock) {
      try {
        sampleRate = requestedSampleRate
        channels = requestedChannels
        val existing = track
        if (existing != null) {
          if (existing.playState != AudioTrack.PLAYSTATE_PLAYING) {
            existing.play()
          }
          return true
        }
        val created = buildTrack()
        created.play()
        track = created
        true
      } catch (error: Throwable) {
        Log.e(TAG, "start failed", error)
        false
      }
    }

  private fun buildTrack(): AudioTrack {
    val channelMask =
      if (channels >= 2) {
        AudioFormat.CHANNEL_OUT_STEREO
      } else {
        AudioFormat.CHANNEL_OUT_MONO
      }
    val minBuffer =
      AudioTrack.getMinBufferSize(
        sampleRate,
        channelMask,
        AudioFormat.ENCODING_PCM_16BIT
      )
    val safeMin = if (minBuffer > 0) minBuffer else FALLBACK_MIN_BUFFER
    val bufferSize = maxOf(safeMin * 2, TARGET_BUFFER_BYTES)
    return AudioTrack.Builder()
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_MEDIA)
          .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
          .build()
      )
      .setAudioFormat(
        AudioFormat.Builder()
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
          .setSampleRate(sampleRate)
          .setChannelMask(channelMask)
          .build()
      )
      .setBufferSizeInBytes(bufferSize)
      .setTransferMode(AudioTrack.MODE_STREAM)
      .build()
  }

  private fun recordWriteResult(written: Int) {
    if (written == ERROR_DEAD) {
      deadObjects.incrementAndGet()
    } else if (written < 0) {
      writeErrors.incrementAndGet()
    }
  }

  @JvmStatic
  fun writePcmDirect(buffer: ByteBuffer, length: Int): Int {
    val current = track ?: return ERROR_DEAD
    return try {
      buffer.limit(minOf(length, buffer.capacity()))
      buffer.position(0)
      val written = current.write(buffer, length, AudioTrack.WRITE_BLOCKING)
      recordWriteResult(written)
      written
    } catch (error: IllegalStateException) {
      deadObjects.incrementAndGet()
      ERROR_DEAD
    } catch (error: Throwable) {
      Log.w(TAG, "writePcmDirect failed", error)
      writeErrors.incrementAndGet()
      ERROR_GENERIC
    }
  }

  @JvmStatic
  fun writePcmDirectBytes(data: ByteArray, offset: Int, length: Int): Int {
    val current = track ?: return ERROR_DEAD
    return try {
      val written = current.write(data, offset, length, AudioTrack.WRITE_BLOCKING)
      recordWriteResult(written)
      written
    } catch (error: IllegalStateException) {
      deadObjects.incrementAndGet()
      ERROR_DEAD
    } catch (error: Throwable) {
      Log.w(TAG, "writePcmDirectBytes failed", error)
      writeErrors.incrementAndGet()
      ERROR_GENERIC
    }
  }

  @JvmStatic
  fun flush() {
    synchronized(lifecycleLock) {
      val current = track ?: return
      try {
        val wasPlaying = current.playState == AudioTrack.PLAYSTATE_PLAYING
        current.pause()
        current.flush()
        if (wasPlaying) {
          current.play()
        }
      } catch (error: Throwable) {
        Log.w(TAG, "flush failed", error)
      }
    }
  }

  @JvmStatic
  fun pauseOutput() {
    try {
      track?.pause()
    } catch (error: Throwable) {
      Log.w(TAG, "pauseOutput failed", error)
    }
  }

  @JvmStatic
  fun resumeOutput() {
    try {
      track?.play()
    } catch (error: Throwable) {
      Log.w(TAG, "resumeOutput failed", error)
    }
  }

  @JvmStatic
  fun stop() {
    synchronized(lifecycleLock) {
      releaseLocked()
    }
  }

  @JvmStatic
  fun release() {
    synchronized(lifecycleLock) {
      releaseLocked()
    }
  }

  private fun releaseLocked() {
    val current = track ?: return
    track = null
    try {
      if (current.playState != AudioTrack.PLAYSTATE_STOPPED) {
        current.pause()
        current.flush()
        current.stop()
      }
    } catch (error: Throwable) {
      Log.w(TAG, "stop during release failed", error)
    }
    try {
      current.release()
    } catch (error: Throwable) {
      Log.w(TAG, "release failed", error)
    }
  }

  @JvmStatic
  fun requestRecreate() {
    synchronized(lifecycleLock) {
      routingEvents.incrementAndGet()
      val old = track ?: return
      val wasPlaying = old.playState == AudioTrack.PLAYSTATE_PLAYING
      try {
        old.pause()
        old.flush()
        old.stop()
        old.release()
      } catch (error: Throwable) {
        Log.w(TAG, "recreate: releasing old track failed", error)
      }
      try {
        val fresh = buildTrack()
        if (wasPlaying) {
          fresh.play()
        }
        track = fresh
      } catch (error: Throwable) {
        Log.e(TAG, "recreate: building new track failed", error)
        track = null
      }
    }
  }

  @JvmStatic fun getRoutingEventCount(): Int = routingEvents.get()

  @JvmStatic fun getDeadObjectCount(): Int = deadObjects.get()

  @JvmStatic fun getWriteErrorCount(): Int = writeErrors.get()

  @JvmStatic fun getPendingOutputMs(): Int = 0
}
