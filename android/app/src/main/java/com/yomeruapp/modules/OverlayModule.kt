package com.yomeruapp.modules

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageButton
import android.widget.TextView
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONArray
import kotlin.math.abs
import kotlin.math.roundToInt

class OverlayModule(private val appContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(appContext),
    LifecycleEventListener {

  private val windowManager =
      appContext.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val mainHandler = Handler(Looper.getMainLooper())

  private var floatingButton: ImageButton? = null
  private var bubbleContainer: FrameLayout? = null
  private var lastPermissionState = Settings.canDrawOverlays(appContext)

  init {
    appContext.addLifecycleEventListener(this)
  }

  override fun getName(): String = "OverlayModule"

  @ReactMethod
  fun addListener(eventName: String) {
    Log.d(LOG_TAG, "[YomeruApp] Listener overlay ditambahkan untuk $eventName")
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    Log.d(LOG_TAG, "[YomeruApp] Listener overlay dikurangi sebanyak $count")
  }

  @ReactMethod
  fun checkOverlayPermission(promise: Promise) {
    promise.resolve(Settings.canDrawOverlays(appContext))
  }

  @ReactMethod
  fun requestOverlayPermission() {
    val intent =
        Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${appContext.packageName}"),
            )
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

    Log.d(LOG_TAG, "[YomeruApp] Membuka pengaturan overlay permission")
    appContext.startActivity(intent)
  }

  @ReactMethod
  fun showFloatingButton() {
    if (!Settings.canDrawOverlays(appContext)) {
      emitPermissionChanged(false)
      return
    }

    mainHandler.post {
      if (floatingButton != null) {
        return@post
      }

      val sizePx = dpToPx(56)
      val marginPx = dpToPx(12)
      val screenMetrics = appContext.resources.displayMetrics
      val layoutParams =
          WindowManager.LayoutParams(
              sizePx,
              sizePx,
              overlayWindowType(),
              WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                  WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
              PixelFormat.TRANSLUCENT,
          ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = screenMetrics.widthPixels - sizePx - marginPx
            y = (screenMetrics.heightPixels / 2) - (sizePx / 2)
          }

      val button =
          ImageButton(appContext).apply {
            background = GradientDrawable().apply {
              shape = GradientDrawable.OVAL
              setColor(Color.parseColor("#1A1A2E"))
            }
            setImageResource(android.R.drawable.ic_menu_camera)
            setColorFilter(Color.WHITE)
            elevation = dpToPx(10).toFloat()
            contentDescription = "Capture manga page"
          }

      attachDragHandler(button, layoutParams, marginPx)

      try {
        windowManager.addView(button, layoutParams)
        floatingButton = button
        Log.d(LOG_TAG, "[YomeruApp] Floating button berhasil ditampilkan")
      } catch (error: Exception) {
        Log.e(LOG_TAG, "[YomeruApp] Gagal menampilkan floating button", error)
      }
    }
  }

  @ReactMethod
  fun removeFloatingButton() {
    mainHandler.post {
      floatingButton?.let { button ->
        runCatching { windowManager.removeView(button) }
            .onFailure { error ->
              Log.e(LOG_TAG, "[YomeruApp] Gagal menghapus floating button", error)
            }
      }
      floatingButton = null
    }
  }

  @ReactMethod
  fun updateOverlayBubbles(data: String) {
    if (!Settings.canDrawOverlays(appContext)) {
      return
    }

    mainHandler.post {
      val payload = runCatching { JSONArray(data) }.getOrElse {
        Log.e(LOG_TAG, "[YomeruApp] JSON overlay bubble tidak valid", it)
        JSONArray()
      }

      ensureBubbleContainer()
      bubbleContainer?.removeAllViews()

      if (payload.length() == 0) {
        return@post
      }

      for (index in 0 until payload.length()) {
        val bubble = payload.getJSONObject(index)
        val position = bubble.getJSONObject("position")
        val translatedText = bubble.optString("translatedText")
        val bubbleView = createBubbleView(translatedText)
        val bubbleWidth = dpToPx(position.optInt("width"))
        val bubbleHeight = dpToPx(position.optInt("height"))
        val layoutParams =
            FrameLayout.LayoutParams(
                bubbleWidth.coerceAtLeast(dpToPx(96)),
                FrameLayout.LayoutParams.WRAP_CONTENT,
            ).apply {
              leftMargin = dpToPx(position.optInt("left"))
              topMargin = dpToPx(position.optInt("top"))
              if (bubbleHeight > 0) {
                height = bubbleHeight.coerceAtLeast(dpToPx(42))
              }
            }

        bubbleContainer?.addView(bubbleView, layoutParams)
      }
    }
  }

  override fun onHostResume() {
    val currentPermission = Settings.canDrawOverlays(appContext)
    if (currentPermission != lastPermissionState) {
      emitPermissionChanged(currentPermission)

      if (!currentPermission) {
        emitEvent("onPermissionRevoked", null)
        clearBubbleOverlay()
        removeFloatingButton()
      }
    }

    lastPermissionState = currentPermission
  }

  override fun onHostPause() = Unit

  override fun onHostDestroy() {
    clearBubbleOverlay()
    removeFloatingButton()
    appContext.removeLifecycleEventListener(this)
  }

  override fun invalidate() {
    super.invalidate()
    clearBubbleOverlay()
    removeFloatingButton()
  }

  private fun attachDragHandler(
      button: ImageButton,
      layoutParams: WindowManager.LayoutParams,
      marginPx: Int,
  ) {
    var initialX = 0
    var initialY = 0
    var initialTouchX = 0f
    var initialTouchY = 0f
    var hasMoved = false

    button.setOnTouchListener { _, event ->
      when (event.action) {
        MotionEvent.ACTION_DOWN -> {
          initialX = layoutParams.x
          initialY = layoutParams.y
          initialTouchX = event.rawX
          initialTouchY = event.rawY
          hasMoved = false
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val deltaX = (event.rawX - initialTouchX).roundToInt()
          val deltaY = (event.rawY - initialTouchY).roundToInt()
          hasMoved = hasMoved || abs(deltaX) > dpToPx(2) || abs(deltaY) > dpToPx(2)
          layoutParams.x = initialX + deltaX
          layoutParams.y = (initialY + deltaY).coerceAtLeast(marginPx)
          runCatching { windowManager.updateViewLayout(button, layoutParams) }
          true
        }
        MotionEvent.ACTION_UP -> {
          if (hasMoved) {
            snapButtonToNearestEdge(button, layoutParams, marginPx)
          } else {
            emitEvent("onCaptureRequested", null)
          }
          true
        }
        else -> false
      }
    }
  }

  private fun snapButtonToNearestEdge(
      button: View,
      layoutParams: WindowManager.LayoutParams,
      marginPx: Int,
  ) {
    val screenWidth = appContext.resources.displayMetrics.widthPixels
    val buttonWidth = floatingButton?.width ?: dpToPx(56)
    val snapLeft = layoutParams.x + (buttonWidth / 2) < (screenWidth / 2)
    layoutParams.x = if (snapLeft) marginPx else screenWidth - buttonWidth - marginPx
    runCatching { windowManager.updateViewLayout(button, layoutParams) }
  }

  private fun ensureBubbleContainer() {
    if (bubbleContainer != null) {
      return
    }

    val layoutParams =
        WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            overlayWindowType(),
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
            PixelFormat.TRANSLUCENT,
        ).apply {
          gravity = Gravity.TOP or Gravity.START
        }

    val container = FrameLayout(appContext)

    runCatching { windowManager.addView(container, layoutParams) }
        .onSuccess {
          bubbleContainer = container
        }
        .onFailure { error ->
          Log.e(LOG_TAG, "[YomeruApp] Gagal membuat bubble container", error)
        }
  }

  private fun clearBubbleOverlay() {
    mainHandler.post {
      bubbleContainer?.let { container ->
        runCatching { windowManager.removeView(container) }
            .onFailure { error ->
              Log.e(LOG_TAG, "[YomeruApp] Gagal menghapus bubble overlay", error)
            }
      }
      bubbleContainer = null
    }
  }

  private fun createBubbleView(text: String): TextView =
      TextView(appContext).apply {
        setTextColor(Color.parseColor("#111827"))
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
        setPadding(dpToPx(6), dpToPx(6), dpToPx(6), dpToPx(6))
        background = GradientDrawable().apply {
          cornerRadius = dpToPx(8).toFloat()
          setColor(Color.argb(235, 255, 255, 255))
        }
        this.text = text
      }

  private fun emitPermissionChanged(granted: Boolean) {
    val payload = Arguments.createMap().apply {
      putBoolean("granted", granted)
    }
    emitEvent("onOverlayPermissionChanged", payload)
  }

  private fun emitEvent(eventName: String, payload: Any?) {
    appContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, payload)
  }

  private fun overlayWindowType(): Int =
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      } else {
        @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE
      }

  private fun dpToPx(value: Int): Int =
      TypedValue.applyDimension(
              TypedValue.COMPLEX_UNIT_DIP,
              value.toFloat(),
              appContext.resources.displayMetrics,
          )
          .roundToInt()

  companion object {
    private const val LOG_TAG = "YomeruApp"
  }
}
