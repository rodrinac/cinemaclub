package tech.kaomidev.cinemaclub.utils

import android.content.Context
import android.content.res.Resources
import android.util.DisplayMetrics
import androidx.core.os.ConfigurationCompat
import com.google.android.material.chip.Chip
import okhttp3.Cache
import tech.kaomidev.cinemaclub.R
import tech.kaomidev.cinemaclub.app.KApplication
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.*

val systemLocale: Locale by lazy {
    ConfigurationCompat.getLocales(Resources.getSystem().configuration).get(0)
}

val localDateFormatter: DateTimeFormatter by lazy {
    DateTimeFormatter.ofLocalizedDate(FormatStyle.SHORT).withZone(ZoneId.systemDefault()).withLocale(systemLocale)
}

const val cacheSize = (5 * 1024 * 1024).toLong()

val globalCache by lazy { Cache(KApplication.cacheDir, cacheSize) }

object Units {
    private val resources by lazy { Resources.getSystem() }

    fun dpToPixels(dp: Int): Float {
        return dp * (resources.displayMetrics.densityDpi / DisplayMetrics.DENSITY_DEFAULT.toFloat())
    }

    @Suppress("unused")
    fun pixelsToDp(px: Float): Float {
        return px / (resources.displayMetrics.densityDpi / DisplayMetrics.DENSITY_DEFAULT.toFloat())
    }
}

fun chipOf(context: Context, text: String) = Chip(context).apply {
    this.text = text
    this.setChipBackgroundColorResource(R.color.colorAccentLight)
}