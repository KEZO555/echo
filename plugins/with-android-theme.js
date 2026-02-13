const {
  withAndroidStyles,
  withAndroidColors,
  withDangerousMod,
} = require("@expo/config-plugins");
const { resolve } = require("node:path");
const { writeFileSync, mkdirSync, existsSync, unlinkSync } = require("node:fs");

function withAndroidThemeColors(config) {
  return withAndroidColors(config, (configWithColors) => {
    const colors = configWithColors.modResults.resources.color || [];

    const setColor = (name, value) => {
      const existingIndex = colors.findIndex((color) => color.$.name === name);
      if (existingIndex >= 0) {
        colors[existingIndex]._ = value;
      } else {
        colors.push({ $: { name }, _: value });
      }
    };

    setColor("splashscreen_background", "#000000");
    setColor("colorPrimary", "#023c69");
    setColor("colorPrimaryDark", "#ffffff");
    setColor("activityBackground", "#000000");

    configWithColors.modResults.resources.color = colors;
    return configWithColors;
  });
}

function withAndroidThemeStyles(config) {
  return withAndroidStyles(config, (configWithStyles) => {
    const styles = configWithStyles.modResults.resources.style || [];

    const appTheme = styles.find((style) => style.$.name === "AppTheme");
    if (appTheme) {
      appTheme.item = appTheme.item || [];

      const setItem = (name, value, attrs = {}) => {
        const existingIndex = appTheme.item.findIndex(
          (item) => item.$.name === name
        );
        const nextItem = { $: { name, ...attrs }, _: value };
        if (existingIndex >= 0) {
          appTheme.item[existingIndex] = nextItem;
        } else {
          appTheme.item.push(nextItem);
        }
      };

      setItem("android:enforceNavigationBarContrast", "true", {
        "tools:targetApi": "29",
      });
      setItem("android:statusBarColor", "#ffffff");
      setItem("android:windowBackground", "@color/activityBackground");
    }

    const splashTheme = styles.find(
      (style) => style.$.name === "Theme.App.SplashScreen"
    );
    if (splashTheme) {
      splashTheme.item = splashTheme.item || [];

      const splashBackground = splashTheme.item.find(
        (item) => item.$.name === "windowSplashScreenBackground"
      );

      if (splashBackground) {
        splashBackground._ = "@color/splashscreen_background";
      } else {
        splashTheme.item.push({
          $: { name: "windowSplashScreenBackground" },
          _: "@color/splashscreen_background",
        });
      }

      const splashItemsToRemove = [
        "windowSplashScreenAnimatedIcon",
        "android:windowSplashScreenAnimatedIcon",
        "android:windowSplashScreenBehavior",
        "windowSplashScreenBehavior",
      ];

      splashTheme.item = splashTheme.item.filter(
        (item) => !splashItemsToRemove.includes(item.$.name)
      );
    }

    if (!configWithStyles.modResults.resources.$) {
      configWithStyles.modResults.resources.$ = {};
    }
    configWithStyles.modResults.resources.$["xmlns:tools"] =
      "http://schemas.android.com/tools";

    return configWithStyles;
  });
}

function withSplashDrawable(config) {
  return withDangerousMod(config, [
    "android",
    (configWithDangerousMod) => {
      const drawablePath = resolve(
        configWithDangerousMod.modRequest.platformProjectRoot,
        "app/src/main/res/drawable"
      );

      if (!existsSync(drawablePath)) {
        mkdirSync(drawablePath, { recursive: true });
      }

      const launcherBackground = `<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
  <item android:drawable="@color/splashscreen_background"/>
</layer-list>
`;

      writeFileSync(
        resolve(drawablePath, "ic_launcher_background.xml"),
        launcherBackground
      );

      return configWithDangerousMod;
    },
  ]);
}

function withRemoveSplashIcon(config) {
  return withDangerousMod(config, [
    "android",
    (configWithDangerousMod) => {
      const densities = ["hdpi", "mdpi", "xhdpi", "xxhdpi", "xxxhdpi"];
      const resPath = resolve(
        configWithDangerousMod.modRequest.platformProjectRoot,
        "app/src/main/res"
      );

      for (const density of densities) {
        const splashIconPath = resolve(
          resPath,
          `drawable-${density}`,
          "splashscreen_logo.png"
        );

        if (existsSync(splashIconPath)) {
          unlinkSync(splashIconPath);
        }
      }

      return configWithDangerousMod;
    },
  ]);
}

module.exports = function withAndroidTheme(config) {
  let nextConfig = config;
  nextConfig = withAndroidThemeColors(nextConfig);
  nextConfig = withAndroidThemeStyles(nextConfig);
  nextConfig = withSplashDrawable(nextConfig);
  nextConfig = withRemoveSplashIcon(nextConfig);
  return nextConfig;
};
