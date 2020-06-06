package tech.kaomidev.cinemaclub.ui.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import tech.kaomidev.cinemaclub.data.movie.MovieRepository

class SearchViewModelProviderFactory(private val repository: MovieRepository) : ViewModelProvider.Factory {

    var query: String = ""

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (query.isBlank()) {
            throw IllegalStateException("A query string should be provided")
        }

        if (modelClass.isAssignableFrom(SearchViewModel::class.java)) {
            return SearchViewModel(repository, query) as T
        }

        throw IllegalArgumentException("Can't create ${modelClass.canonicalName} class")
    }
}
