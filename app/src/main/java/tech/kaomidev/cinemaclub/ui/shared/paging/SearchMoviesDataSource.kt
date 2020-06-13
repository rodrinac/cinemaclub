package tech.kaomidev.cinemaclub.ui.shared.paging

import androidx.paging.PageKeyedDataSource
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import tech.kaomidev.cinemaclub.domain.entity.Movie
import tech.kaomidev.cinemaclub.domain.repository.MovieRepository

class SearchMoviesDataSource(
    private val movieRepository: MovieRepository,
    private val scope: CoroutineScope,
    private val query: String)
    : PageKeyedDataSource<Long, Movie>() {

    override fun loadInitial(params: LoadInitialParams<Long>, callback: LoadInitialCallback<Long, Movie>) {
        scope.launch {
            val movies = movieRepository.searchMovies(query, FIRST_PAGE)
            callback.onResult(movies, null, FIRST_PAGE + 1)
        }
    }

    override fun loadAfter(params: LoadParams<Long>, callback: LoadCallback<Long, Movie>) {
        scope.launch {
            val movies = movieRepository.searchMovies(query, params.key)
            callback.onResult(movies, if(movies.isEmpty()) null else params.key + 1)
        }
    }

    override fun loadBefore(params: LoadParams<Long>, callback: LoadCallback<Long, Movie>) {
        scope.launch {
            val movies = movieRepository.searchMovies(query, params.key)
            callback.onResult(movies, if(params.key > 1) params.key - 1 else null)
        }
    }

    companion object {
        const val FIRST_PAGE: Long = 1
        const val PAGE_SIZE: Int = 20
    }
}