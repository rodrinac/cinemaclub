package tech.kaomidev.cinemaclub.network.interceptors

import okhttp3.Interceptor
import tech.kaomidev.cinemaclub.BuildConfig

fun makeHeadersInterceptor() = Interceptor { chain ->
    chain.proceed(chain.request().newBuilder()
        .addHeader("Accept", "application/json")
        .addHeader("Accept-Language", "en")
        .addHeader("Content-Type", "application/json")
        .addHeader("Authorization", "Bearer ${BuildConfig.TmdbApiToken}")
        .build())
}