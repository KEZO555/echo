const { withAndroidManifest } = require("@expo/config-plugins");

module.exports = function withAndroidConfigChanges(config) {
  return withAndroidManifest(config, (configWithManifest) => {
    const mainActivity =
      configWithManifest.modResults.manifest.application?.[0]?.activity?.find(
        (activity) => activity.$["android:name"] === ".MainActivity"
      );

    if (mainActivity) {
      mainActivity.$["android:configChanges"] =
        "keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode|density|fontScale|smallestScreenSize";
    }

    return configWithManifest;
  });
};
