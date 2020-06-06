package tech.kaomidev.cinemaclub.network.config

import okhttp3.OkHttpClient
import tech.kaomidev.cinemaclub.network.interceptors.makeHeadersInterceptor
import tech.kaomidev.cinemaclub.network.interceptors.makeLoggingInterceptor
import tech.kaomidev.cinemaclub.utils.globalCache
import java.util.concurrent.TimeUnit

fun makeHttpClient(): OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(60, TimeUnit.SECONDS)
    .readTimeout(60, TimeUnit.SECONDS)
    .addInterceptor(makeHeadersInterceptor())
    .addInterceptor(makeLoggingInterceptor())
    .cache(globalCache)
    .build()