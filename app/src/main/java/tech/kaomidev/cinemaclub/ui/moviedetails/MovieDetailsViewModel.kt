package tech.kaomidev.cinemaclub.ui.moviedetails

import androidx.lifecycle.LiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.liveData
import tech.kaomidev.cinemaclub.data.movie.Movie
import tech.kaomidev.cinemaclub.data.movie.MovieRepository

class MovieDetailsViewModel(repository: MovieRepository, movieId: Long) : ViewModel() {

    val movie: LiveData<Movie> = liveData { emit(repository.findMovie(movieId))  }
}