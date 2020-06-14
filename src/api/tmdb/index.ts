import axios from 'axios';
import conf from './conf.json';

const api = axios.create({
  baseURL: 'https://api.themoviedb.org/3/',
  headers: {
    'Accept': 'application/json',
    'Accept-Language': 'en',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${conf.authToken}`
  }
});

export default api;
export * from './models';
/*

interface TmdbApi {

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
fun makeHeadersInterceptor() = Interceptor { chain ->
    chain.proceed(chain.request().newBuilder()
        .addHeader("Accept", "application/json")
        .addHeader("Accept-Language", "en")
        .addHeader("Content-Type", "application/json")
        .addHeader("Authorization", "Bearer ${BuildConfig.TmdbApiToken}")
        .build())
}*/