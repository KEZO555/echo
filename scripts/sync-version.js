const fs = require("fs");
const path = require("path");

console.log("🔄 Syncing Android version from app.json...\n");

try {
	// Read version from app.json
	const appConfig = JSON.parse(fs.readFileSync("app.json", "utf8"));
	const version = appConfig.expo.version;

	console.log(`📱 Target version: ${version}`);

	// Update package.json
	const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
	const oldPackageVersion = packageJson.version;
	packageJson.version = version;
	fs.writeFileSync(
		"package.json",
		JSON.stringify(packageJson, null, "\t") + "\n"
	);
	console.log(`✓ Updated package.json: ${oldPackageVersion} → ${version}`);

	// Update Android build.gradle
	const buildGradlePath = "android/app/build.gradle";
	let buildGradle = fs.readFileSync(buildGradlePath, "utf8");

	// Extract current version for logging
	const currentVersionMatch = buildGradle.match(/versionName\s+"([^"]*)"/);
	const oldAndroidVersion = currentVersionMatch
		? currentVersionMatch[1]
		: "unknown";

	buildGradle = buildGradle.replace(
		/versionName\s+"[^"]*"/,
		`versionName "${version}"`
	);
	fs.writeFileSync(buildGradlePath, buildGradle);
	console.log(
		`✓ Updated android/app/build.gradle: ${oldAndroidVersion} → ${version}`
	);

	console.log("\n🎉 Android version sync complete!");
	console.log('💡 Run "bun run android" to rebuild with the new version');
} catch (error) {
	console.error("❌ Error syncing version:", error.message);
	process.exit(1);
}
