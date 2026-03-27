const { withProjectBuildGradle, withAppBuildGradle } = require("@expo/config-plugins");

module.exports = function withAndroidSdkVersion(config) {
  const compileSdkVersion = config.android?.compileSdkVersion || 35;
  const targetSdkVersion = config.android?.targetSdkVersion || 34;
  const minSdkVersion = config.android?.minSdkVersion || 24;

  // First, set ext variables in project-level build.gradle
  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let contents = config.modResults.contents;

      // Remove any existing ext block for our variables
      contents = contents.replace(
        /ext\s*\{[\s\S]*?compileSdkVersion[\s\S]*?\n\s*\}/g,
        ""
      );

      // Remove any existing subprojects block that might conflict
      const subprojectsRegex = /subprojects\s*\{[\s\S]*?compileSdkVersion[\s\S]*?\n\s*\}/g;
      contents = contents.replace(subprojectsRegex, "");

      // Add ext block after buildscript if it exists, otherwise at the top
      const extBlock = `
ext {
    compileSdkVersion = ${compileSdkVersion}
    targetSdkVersion = ${targetSdkVersion}
    minSdkVersion = ${minSdkVersion}
}`;

      if (contents.includes("buildscript {")) {
        // Find the end of buildscript block
        let buildscriptEnd = contents.indexOf("}", contents.indexOf("buildscript {"));
        let depth = 1;
        for (let i = contents.indexOf("buildscript {") + 1; i < contents.length && depth > 0; i++) {
          if (contents[i] === '{') depth++;
          if (contents[i] === '}') depth--;
          if (depth === 0) {
            buildscriptEnd = i;
            break;
          }
        }
        contents = contents.slice(0, buildscriptEnd + 1) + 
                   `\n${extBlock}` + 
                   contents.slice(buildscriptEnd + 1);
      } else {
        contents = extBlock + "\n\n" + contents;
      }

      // Add subprojects configuration to apply SDK versions to all modules
      // This forcefully overrides compileSdkVersion for all native modules including react-native-ble-advertiser
      const subprojectsBlock = `
subprojects {
    afterEvaluate { project ->
        if (project.hasProperty("android")) {
            def android = project.android
            // Forcefully override compileSdkVersion - this is critical for modules like react-native-ble-advertiser
            // This will override any hardcoded compileSdkVersion in the module's build.gradle
            android.compileSdkVersion ${compileSdkVersion}
        }
    }
}`;

      // Insert subprojects block before allprojects or at the end
      if (contents.includes("allprojects {")) {
        contents = contents.replace(
          /(allprojects\s*\{)/,
          `${subprojectsBlock}\n\n$1`
        );
      } else {
        contents = contents.trim() + `\n\n${subprojectsBlock}`;
      }

      config.modResults.contents = contents;
    }
    return config;
  });

  // Also ensure the app-level build.gradle uses the correct versions
  config = withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let contents = config.modResults.contents;

      // Ensure compileSdkVersion is set
      if (contents.includes("android {")) {
        // Replace existing compileSdkVersion
        contents = contents.replace(
          /compileSdkVersion\s+\d+/g,
          `compileSdkVersion ${compileSdkVersion}`
        );
        
        // If compileSdkVersion not found, add it
        if (!contents.match(/compileSdkVersion\s+\d+/)) {
          contents = contents.replace(
            /(android\s*\{)/,
            `$1\n    compileSdkVersion ${compileSdkVersion}`
          );
        }

        // Ensure targetSdkVersion is set
        contents = contents.replace(
          /targetSdkVersion\s+\d+/g,
          `targetSdkVersion ${targetSdkVersion}`
        );

        // Ensure minSdkVersion is set in defaultConfig
        if (contents.includes("defaultConfig {")) {
          contents = contents.replace(
            /minSdkVersion\s+\d+/g,
            `minSdkVersion ${minSdkVersion}`
          );
        }
      }

      config.modResults.contents = contents;
    }
    return config;
  });

  return config;
};

