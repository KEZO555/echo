package com.vandam.echo
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import expo.modules.ReactActivityDelegateWrapper
import expo.modules.splashscreen.SplashScreenManager

class MainActivity : ReactActivity() {
    private var wasGrayscaleEnabled = false
    private var previousDaltonizerMode = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        // Set the theme to AppTheme BEFORE onCreate to support
        // coloring the background, status bar, and navigation bar.
        // This is required for expo-splash-screen.
        // setTheme(R.style.AppTheme);
        // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
        SplashScreenManager.registerOnActivity(this)
        // @generated end expo-splashscreen
        super.onCreate(null)
    }

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "main"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate =
        ReactActivityDelegateWrapper(
            this,
            BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
            object : DefaultReactActivityDelegate(
                this,
                mainComponentName,
                fabricEnabled,
            ) {},
        )

    /**
     * Align the back button behavior with Android S
     * where moving root activities to background instead of finishing activities.
     * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
     */
    override fun invokeDefaultOnBackPressed() {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
            if (!moveTaskToBack(false)) {
                // For non-root activities, use the default implementation to finish them.
                super.invokeDefaultOnBackPressed()
            }
            return
        }

        // Use the default back button implementation on Android S
        // because it's doing more than [Activity.moveTaskToBack] in fact.
        super.invokeDefaultOnBackPressed()
    }

    private var didWeDisableDaltonizer = false

    override fun onResume() {
        super.onResume()
        disableDaltonizer()
    }

    override fun onPause() {
        restoreDaltonizer()
        super.onPause()
    }

    private fun disableDaltonizer() {
        val daltonizerEnabled =
            Settings.Secure.getInt(
                contentResolver,
                "accessibility_display_daltonizer_enabled",
                0,
            )

        if (daltonizerEnabled == 1) {
            val daltonizerMode =
                Settings.Secure.getInt(
                    contentResolver,
                    "accessibility_display_daltonizer",
                    0,
                )

            wasGrayscaleEnabled = true
            previousDaltonizerMode = daltonizerMode
            didWeDisableDaltonizer = true

            try {
                Settings.Secure.putInt(contentResolver, "accessibility_display_daltonizer_enabled", 0)
                Log.d("Daltonizer", "Disabled (was mode: $daltonizerMode)")
            } catch (e: SecurityException) {
                Log.e("Daltonizer", "No permission - run: adb shell pm grant com.vandam.echo android.permission.WRITE_SECURE_SETTINGS")
            }
        }
    }

    private fun restoreDaltonizer() {
        if (didWeDisableDaltonizer && wasGrayscaleEnabled) {
            try {
                Settings.Secure.putInt(contentResolver, "accessibility_display_daltonizer", previousDaltonizerMode)
                Settings.Secure.putInt(contentResolver, "accessibility_display_daltonizer_enabled", 1)
                Log.d("Daltonizer", "Restored (mode: $previousDaltonizerMode)")
            } catch (e: SecurityException) {
                Log.e("Daltonizer", "No permission to restore")
            }
            didWeDisableDaltonizer = false
        }
    }
}
