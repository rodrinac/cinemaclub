package tech.kaomidev.cinemaclub.data.movie

import tech.kaomidev.cinemaclub.data.genre.Genre

data class Movie(
    val id: Long? = null,
    val title: String? = null,
    val originalTitle: String? = null,
    val originalLanguage: String? = null,
    val backdropPath: String? = null,
    val posterPath: String? = null,
    val overview: String? = null,
    val releaseDate: String? = null,
    val genreIds: List<Long>? = null,
    val adult: Boolean? = null,
    val popularity: Float? = null,
    val voteCount: Long? = null,
    val voteAverage: Float? =null,
    var genres: List<Genre>? = null
)