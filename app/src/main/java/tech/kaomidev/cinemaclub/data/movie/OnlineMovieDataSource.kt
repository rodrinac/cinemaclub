package tech.kaomidev.cinemaclub.data.movie

import tech.kaomidev.cinemaclub.network.TmdbApi
import tech.kaomidev.cinemaclub.network.dto.MovieDto
import tech.kaomidev.cinemaclub.network.dto.ResultPage
import tech.kaomidev.cinemaclub.utils.systemLocale

class OnlineMovieDataSource(private val api: TmdbApi) {

    suspend fun getPopularMovies(page: Long? = null) : ResultPage<MovieDto> {
        return api.discoverMovies(systemLocale.toLanguageTag(), page)
    }

    suspend fun searchMovies(query: String, page: Long? = null) : ResultPage<MovieDto> {
        return api.searchMovies(systemLocale.toLanguageTag(), page, query)
    }

    suspend fun findMovies(movieId: Long) : MovieDto {
        return api.findMovie(movieId, systemLocale.toLanguageTag())
    }
}