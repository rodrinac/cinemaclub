package tech.kaomidev.cinemaclub.ui.shared.paging

import androidx.paging.DataSource
import kotlinx.coroutines.CoroutineScope
import tech.kaomidev.cinemaclub.domain.entity.Movie
import tech.kaomidev.cinemaclub.domain.repository.MovieRepository

class PopularMoviesDataSourceFactory(
    private val movieRepository: MovieRepository,
    private val scope: CoroutineScope) : DataSource.Factory<Long, Movie>() {

    override fun create(): DataSource<Long, Movie> {
        return PopularMoviesDataSource(movieRepository, scope)
    }
}