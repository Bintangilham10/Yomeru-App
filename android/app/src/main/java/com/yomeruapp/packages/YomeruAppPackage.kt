package com.yomeruapp.packages

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.yomeruapp.modules.OcrModule
import com.yomeruapp.modules.OverlayModule
import com.yomeruapp.modules.ScreenCaptureModule
import com.yomeruapp.modules.TranslationModule

class YomeruAppPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = listOf(
      OverlayModule(reactContext),
      ScreenCaptureModule(reactContext),
      OcrModule(reactContext),
      TranslationModule(reactContext),
  )

  override fun createViewManagers(
      reactContext: ReactApplicationContext,
  ): List<ViewManager<*, *>> = emptyList()
}
