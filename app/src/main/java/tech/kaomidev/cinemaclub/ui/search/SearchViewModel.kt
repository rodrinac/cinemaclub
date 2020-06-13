package tech.kaomidev.cinemaclub.ui.search

import androidx.lifecycle.LiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.paging.LivePagedListBuilder
import androidx.paging.PagedList
import tech.kaomidev.cinemaclub.domain.entity.Movie
import tech.kaomidev.cinemaclub.domain.repository.MovieRepository
import tech.kaomidev.cinemaclub.ui.shared.paging.SearchMoviesDataSource
import tech.kaomidev.cinemaclub.ui.shared.paging.SearchMoviesDataSourceFactory

class SearchViewModel(movieRepository: MovieRepository, query: String) : ViewModel() {
    private val dataSourceFactory = SearchMoviesDataSourceFactory(movieRepository, viewModelScope, query)
    var moviePagedList: LiveData<PagedList<Movie>>

    init {
        val pagedListConfig= PagedList.Config.Builder()
            .setEnablePlaceholders(true)
            .setPageSize(SearchMoviesDataSource.PAGE_SIZE)
            .setPrefetchDistance(1)
            .build()

        moviePagedList = LivePagedListBuilder(dataSourceFactory, pagedListConfig).build()
    }
}
