package tech.kaomidev.cinemaclub.ui.shared.paging

import androidx.paging.DataSource
import kotlinx.coroutines.CoroutineScope
import tech.kaomidev.cinemaclub.data.movie.Movie
import tech.kaomidev.cinemaclub.data.movie.MovieRepository

class SearchMoviesDataSourceFactory(
        private val movieRepository: MovieRepository,
        private val scope: CoroutineScope,
        private val query: String)
    : DataSource.Factory<Long, Movie>() {

    override fun create(): DataSource<Long, Movie> {
        return SearchMoviesDataSource(movieRepository, scope, query)
    }
}