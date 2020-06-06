package tech.kaomidev.cinemaclub.network

import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query
import tech.kaomidev.cinemaclub.network.dto.GenreList
import tech.kaomidev.cinemaclub.network.dto.MovieDto
import tech.kaomidev.cinemaclub.network.dto.ResultPage

interface TmdbApi {

    @GET("discover/movie")
    suspend fun discoverMovies(
        @Query("language") language: String = "en-US",
        @Query("page") page: Long? = null,
        @Query("sort_by") sortBy: String = "popularity.desc"
    ) : ResultPage<MovieDto>

    @GET("search/movie")
    suspend fun searchMovies(
        @Query("language") language: String = "en-US",
        @Query("page") page: Long? = null,
        @Query("query") query: String
    ) : ResultPage<MovieDto>

    @GET("movie/{id}")
    suspend fun findMovie(
        @Path("id") movieId: Long,
        @Query("language") language: String = "en-US"
    ) : MovieDto

    @GET("genre/movie/list")
    suspend fun getMovieGenres(
        @Query("language") language: String = "en-US"
    ) : GenreList
}