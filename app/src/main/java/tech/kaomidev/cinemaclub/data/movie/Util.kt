package tech.kaomidev.cinemaclub.data.movie

import tech.kaomidev.cinemaclub.data.genre.toItem
import tech.kaomidev.cinemaclub.network.dto.MovieDto

fun MovieDto.toItem() : Movie {
    return Movie(
        id,
        title,
        originalTitle,
        originalLanguage,
        backdropPath,
        posterPath,
        overview,
        releaseDate,
        genreIds,
        adult,
        popularity,
        voteCount,
        voteAverage,
        genres?.map { it.toItem() }
    )
}