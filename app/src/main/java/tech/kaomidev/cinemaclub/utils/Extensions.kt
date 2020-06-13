package tech.kaomidev.cinemaclub.utils

import android.util.Log
import tech.kaomidev.cinemaclub.domain.entity.Genre
import tech.kaomidev.cinemaclub.domain.entity.Movie
import tech.kaomidev.cinemaclub.network.dto.GenreDto
import tech.kaomidev.cinemaclub.network.dto.MovieDto
import java.time.LocalDate

fun String.toLocalDate() = try {
        LocalDate.parse(this)
    } catch (ex: Exception) {
        Log.e("String\$LocalDate", ex.message)
        null
    }

fun GenreDto.toItem() : Genre {
    return Genre(id, name)
}

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
