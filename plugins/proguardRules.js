const { withDangerousMod } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

// `expo prebuild` regenerates android/ and wipes app/proguard-rules.pro. These keep rules
// are load-bearing for minified release builds (R8 strips expo-gl's reflectively-loaded
// GLView constructor and its JNI-looked-up GLContext.flush → hard crashes), so re-append
// them on every prebuild. Rules and rationale are commented in place; background in .log
// ("R8 vs expo-gl", 2026-10-18).
const RULES = `
# castafiore: custom keep rules (managed by plugins/proguardRules.js)

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# expo-gl (2026-10-18): GLView is instantiated reflectively by expo-modules-core's
# SimpleViewManagerWrapper, but it extends TextureView directly instead of expo's
# ExpoView base class, so expo-modules-core's generic ExpoView constructor keep rules
# do not apply to it. Without this rule a minified release build crashes at first
# render with: IllegalStateException: Didn't find a correct constructor for class
# expo.modules.gl.GLView (obfuscated name in the stack, e.g. I6.d).
-keep class expo.modules.gl.GLView {
	public <init>(android.content.Context, expo.modules.kotlin.AppContext);
}

# expo-gl (2026-10-18): its C++ JNI bridge (libexpo-gl.so, EXGLJniApi.cpp:
# Java_expo_modules_gl_cpp_EXGL_EXGLContextPrepare) resolves GLContext.flush()
# by exact name at runtime via GetMethodID("flush", "()V"). If R8 renames the
# method, the lookup returns a null jmethodID and the first GL frame aborts the
# process with: JNI DETECTED ERROR IN APPLICATION: mid == null.
-keepclassmembers class expo.modules.gl.GLContext {
	void flush();
}
`

module.exports = function withProguardRules(config) {
	return withDangerousMod(config, ['android', async (config) => {
		const file = path.join(config.modRequest.platformProjectRoot, 'app', 'proguard-rules.pro')
		let contents = ''
		try {
			contents = fs.readFileSync(file, 'utf8')
		} catch {
			return config // no android project yet — nothing to do
		}
		if (contents.includes('expo.modules.gl.GLView')) return config // already applied
		fs.appendFileSync(file, RULES)
		return config
	}])
}
