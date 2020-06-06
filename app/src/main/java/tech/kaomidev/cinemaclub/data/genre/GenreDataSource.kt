package tech.kaomidev.cinemaclub.data.genre

interface GenreDataSource {
    suspend fun getMovieGenres() : List<Genre>
}