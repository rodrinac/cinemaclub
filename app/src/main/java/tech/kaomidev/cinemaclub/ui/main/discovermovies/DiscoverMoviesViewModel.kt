package tech.kaomidev.cinemaclub.ui.main.discovermovies

import androidx.lifecycle.LiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.LivePagedListBuilder
import androidx.paging.PagedList
import tech.kaomidev.cinemaclub.domain.entity.Movie
import tech.kaomidev.cinemaclub.domain.repository.MovieRepository
import tech.kaomidev.cinemaclub.ui.shared.paging.PopularMoviesDataSourceFactory
import tech.kaomidev.cinemaclub.ui.shared.paging.PopularMoviesDataSource

class DiscoverMoviesViewModel(movieRepository: MovieRepository) : ViewModel() {

    private val dataSourceFactory = PopularMoviesDataSourceFactory(movieRepository, viewModelScope)
    val moviePagedList: LiveData<PagedList<Movie>>

    init {
        val pagedListConfig= PagedList.Config.Builder()
            .setEnablePlaceholders(true)
            .setPageSize(PopularMoviesDataSource.PAGE_SIZE)
            .setPrefetchDistance(1)
            .build()

        moviePagedList = LivePagedListBuilder(dataSourceFactory, pagedListConfig).build()
    }
}