package tech.kaomidev.cinemaclub.ui.moviedetails

import androidx.lifecycle.LiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.liveData
import tech.kaomidev.cinemaclub.domain.entity.Movie
import tech.kaomidev.cinemaclub.domain.repository.MovieRepository

class MovieDetailsViewModel(repository: MovieRepository, movieId: Long) : ViewModel() {

    val movie: LiveData<Movie> = liveData { emit(repository.findMovie(movieId))  }
}