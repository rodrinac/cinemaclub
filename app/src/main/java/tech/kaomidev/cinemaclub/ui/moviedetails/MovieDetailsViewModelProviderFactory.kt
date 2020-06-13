package tech.kaomidev.cinemaclub.ui.moviedetails

import androidx.annotation.IntRange
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import tech.kaomidev.cinemaclub.domain.repository.MovieRepository

class MovieDetailsViewModelProviderFactory(private val repository: MovieRepository) : ViewModelProvider.Factory {

    @IntRange(from = 0) var movieId: Long = 0

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {

        if (movieId <= 0.toLong()) {
            throw IllegalStateException("The id of them movie should be provided")
        }

        if (modelClass.isAssignableFrom(MovieDetailsViewModel::class.java)) {
            return MovieDetailsViewModel(repository, movieId) as T
        }

        throw IllegalArgumentException("Can't create ${modelClass.canonicalName} class")
    }
}
