#!/usr/bin/env bash
#
# Cross-compiles rust/spotify-core for Android and generates the UniFFI Kotlin
# bindings into the spotify-engine Expo module. Adapted from Phono's
# scripts/build-rust.sh (MIT).
#
# Prerequisites:
#   - rustup with Android targets: rustup target add aarch64-linux-android
#   - cargo-ndk: cargo install cargo-ndk
#   - ANDROID_NDK_HOME (or ANDROID_NDK_ROOT) set.
#
# Output:
#   - modules/spotify-engine/android/src/main/jniLibs/<abi>/libspotify_core.so
#   - modules/spotify-engine/android/src/main/java/com/lightphone/spotify/ffi/*.kt

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CRATE_DIR="$REPO_ROOT/rust/spotify-core"
MODULE_ANDROID="$REPO_ROOT/modules/spotify-engine/android"
JNILIBS_DIR="$MODULE_ANDROID/src/main/jniLibs"
BINDINGS_DIR="$MODULE_ANDROID/src/main/java"

read -r -a ABIS <<< "${ANDROID_ABIS:-arm64-v8a}"

echo "==> Cross-compiling spotify-core (release) for: ${ABIS[*]}"
NDK_ARGS=()
for abi in "${ABIS[@]}"; do
    NDK_ARGS+=(-t "$abi")
done

(
    cd "$CRATE_DIR"
    # AudioTrack sink (Path C in Phono's docs) - no extra native audio deps.
    cargo ndk "${NDK_ARGS[@]}" -o "$JNILIBS_DIR" \
        --platform 26 \
        build --release --no-default-features --features audiotrack-sink
)

echo "==> Generating UniFFI Kotlin bindings"
# Generate from an unstripped host build; the metadata is target-independent.
(
    cd "$CRATE_DIR"
    # audiotrack-sink avoids host ALSA/cpal build deps; the UniFFI metadata
    # we need is identical either way.
    cargo build --no-default-features --features audiotrack-sink
    TARGET_DIR="${CARGO_TARGET_DIR:-$CRATE_DIR/target}"
    HOST_LIB=""
    for ext in dylib so; do
        cand="$TARGET_DIR/debug/libspotify_core.$ext"
        [ -f "$cand" ] && HOST_LIB="$cand" && break
    done
    [ -z "$HOST_LIB" ] && { echo "ERROR: host libspotify_core not found"; exit 1; }
    cargo run --bin uniffi-bindgen -- generate \
        --library "$HOST_LIB" \
        --language kotlin \
        --out-dir "$BINDINGS_DIR"
)

echo "==> Done."
