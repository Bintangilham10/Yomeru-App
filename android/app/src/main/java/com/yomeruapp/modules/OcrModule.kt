package com.yomeruapp.modules

import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.Text
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions
import java.io.File

class OcrModule(private val appContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(appContext) {

  private val recognizer =
      TextRecognition.getClient(JapaneseTextRecognizerOptions.Builder().build())

  override fun getName(): String = "OcrModule"

  @ReactMethod
  fun recognizeText(imagePath: String, promise: Promise) {
    val imageFile = File(imagePath)
    if (!imageFile.exists()) {
      promise.reject("IMAGE_NOT_FOUND", "File screenshot tidak ditemukan di $imagePath")
      return
    }

    val image = InputImage.fromFilePath(appContext, Uri.fromFile(imageFile))
    val metrics = appContext.resources.displayMetrics

    recognizer
        .process(image)
        .addOnSuccessListener { result ->
          val blocks = Arguments.createArray()
          val acceptedTexts = mutableListOf<String>()

          result.textBlocks.forEach { block ->
            val frame = block.boundingBox ?: return@forEach
            val text = block.text.trim()
            val confidence = calculateConfidence(block)

            // Filter utama dilakukan di native agar JS hanya menerima bubble yang relevan.
            if (confidence < MIN_CONFIDENCE) {
              return@forEach
            }
            if (text.length < 2 || !containsCjk(text)) {
              return@forEach
            }
            if (
                frame.left < 0 ||
                    frame.top < 0 ||
                    frame.right > metrics.widthPixels ||
                    frame.bottom > metrics.heightPixels
            ) {
              return@forEach
            }

            val item = Arguments.createMap().apply {
              putString("text", text)
              putInt("left", pxToDp(frame.left))
              putInt("top", pxToDp(frame.top))
              putInt("width", pxToDp(frame.width()))
              putInt("height", pxToDp(frame.height()))
              putDouble("confidence", confidence.toDouble())
            }

            acceptedTexts += text
            blocks.pushMap(item)
          }

          promise.resolve(
              Arguments.createMap().apply {
                putString("fullText", acceptedTexts.joinToString("\n"))
                putArray("blocks", blocks)
              },
          )
        }
        .addOnFailureListener { error ->
          Log.e(LOG_TAG, "[YomeruApp] OCR gagal untuk $imagePath", error)
          promise.reject("OCR_FAILED", "OCR gagal: ${error.message}", error)
        }
  }

  override fun invalidate() {
    super.invalidate()
    recognizer.close()
  }

  private fun calculateConfidence(block: Text.TextBlock): Float {
    val values = mutableListOf<Float>()

    block.lines.forEach { line ->
      line.elements.forEach { element ->
        if (element.confidence > 0f) {
          values += element.confidence
        }
      }
    }

    return if (values.isEmpty()) {
      1f
    } else {
      values.average().toFloat()
    }
  }

  private fun containsCjk(text: String): Boolean = CJK_REGEX.containsMatchIn(text)

  private fun pxToDp(value: Int): Int = (value / appContext.resources.displayMetrics.density).toInt()

  companion object {
    private val CJK_REGEX =
        Regex("[\\p{InHiragana}\\p{InKatakana}\\p{InCJK_Unified_Ideographs}]")
    private const val LOG_TAG = "YomeruApp"
    private const val MIN_CONFIDENCE = 0.6f
  }
}
