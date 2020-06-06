package tech.kaomidev.cinemaclub.data.genre

import tech.kaomidev.cinemaclub.network.dto.GenreDto

fun GenreDto.toItem() : Genre {
    return Genre(id, name)
}