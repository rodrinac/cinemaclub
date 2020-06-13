package tech.kaomidev.cinemaclub.utils

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkInfo
import android.view.LayoutInflater
import android.view.MenuItem
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import androidx.annotation.LayoutRes
import androidx.core.graphics.drawable.DrawableCompat
import com.bumptech.glide.Glide
import com.bumptech.glide.load.resource.bitmap.RoundedCorners
import com.bumptech.glide.request.RequestOptions
import com.google.android.material.chip.Chip
import tech.kaomidev.cinemaclub.R

fun Context.hasNetwork(): Boolean {
    val connectivityManager = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val activeNetwork: NetworkInfo? = connectivityManager.activeNetworkInfo

    return activeNetwork != null && activeNetwork.isConnected
}

fun Context.doOnNetwork(online: () -> Unit, offline: (() -> Unit)? = null)
        = if (hasNetwork()) online() else offline?.invoke()

fun ViewGroup.inflateView(@LayoutRes layoutId: Int, attachToRoot: Boolean = false) : View {
    return LayoutInflater.from(context).inflate(layoutId, this, attachToRoot)
}

fun ImageView.loadUrl(path: String, centerCropped: Boolean = false, radius: Int? = null) {

    val options = if (radius != null)
        RequestOptions.bitmapTransform(RoundedCorners(radius))
        else RequestOptions().apply {
            if (centerCropped) centerCrop()
    }

    Glide.with(context)
        .load(path)
        .apply(options)
        .into(this)
}

fun MenuItem.setIconTint(color: Int): MenuItem {

    val newIcon = DrawableCompat.wrap(this.icon)

    DrawableCompat.setTint(newIcon, color)

    this.icon = newIcon

    return this
}

fun Activity.getExtraLong(key: String): Lazy<Long> = lazy {
    intent?.extras?.getLong(key) ?: throw Error("No value $key in extras")
}

inline fun <reified T : Activity> Context.getIntent() = Intent(this, T::class.java)

fun Context.makeChip(text: String) = Chip(this).apply {
    this.text = text
    this.setChipBackgroundColorResource(R.color.colorAccentLight)
}
