package tech.kaomidev.cinemaclub.network

import tech.kaomidev.cinemaclub.network.config.retrofit

object Tmdb {

    val api by lazy { getInstance() }

    private fun getInstance() : TmdbApi {
        return retrofit.create(TmdbApi::class.java)
    }
}
