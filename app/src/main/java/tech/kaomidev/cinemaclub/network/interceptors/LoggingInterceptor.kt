package tech.kaomidev.cinemaclub.network.interceptors

import okhttp3.logging.HttpLoggingInterceptor
import tech.kaomidev.cinemaclub.BuildConfig

fun makeLoggingInterceptor() = HttpLoggingInterceptor().apply {
    level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC
        else HttpLoggingInterceptor.Level.NONE
}