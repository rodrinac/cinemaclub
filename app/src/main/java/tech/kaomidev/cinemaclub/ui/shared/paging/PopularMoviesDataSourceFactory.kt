package tech.kaomidev.cinemaclub.ui.shared.paging

import androidx.paging.DataSource
import kotlinx.coroutines.CoroutineScope
import tech.kaomidev.cinemaclub.data.movie.Movie
import tech.kaomidev.cinemaclub.data.movie.MovieRepository

class PopularMoviesDataSourceFactory(
    private val movieRepository: MovieRepository,
    private val scope: CoroutineScope) : DataSource.Factory<Long, Movie>() {

    override fun create(): DataSource<Long, Movie> {
        return PopularMoviesDataSource(movieRepository, scope)
    }
}