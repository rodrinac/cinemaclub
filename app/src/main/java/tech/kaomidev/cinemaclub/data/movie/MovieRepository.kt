package tech.kaomidev.cinemaclub.data.movie

import tech.kaomidev.cinemaclub.data.genre.GenreRepository

class MovieRepository(
    private val dataSourceOnline: OnlineMovieDataSource,
    private val genreRepository: GenreRepository) {

     suspend fun getPopularMovies(page: Long? = null) : List<Movie> {
         val response = dataSourceOnline.getPopularMovies(page)

         return response.results?.map { it.toItem() } ?: listOf()
     }

    suspend fun searchMovies(query: String, page: Long? = null) : List<Movie> {
        val response = dataSourceOnline.searchMovies(query, page)

        val movies = response.results?.map { it.toItem() } ?: listOf()

        for (movie in movies) {
            movie.genres = genreRepository.getMovieGenreById(movie.genreIds ?: listOf())
        }

        return movies
    }

    suspend fun findMovie(movieId: Long) : Movie {
        return dataSourceOnline.findMovies(movieId).toItem()
    }
}