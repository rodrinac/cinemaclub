package tech.kaomidev.cinemaclub.data.genre

import tech.kaomidev.cinemaclub.network.TmdbApi
import tech.kaomidev.cinemaclub.utils.systemLocale

class OnlineGenreDataSource(private val api: TmdbApi) : GenreDataSource {

    override suspend fun getMovieGenres() : List<Genre> {
        val response = api.getMovieGenres(systemLocale.toLanguageTag())

        return response.genres?.map { it.toItem() } ?: listOf()
    }
}