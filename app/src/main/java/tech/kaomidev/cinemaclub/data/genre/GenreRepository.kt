package tech.kaomidev.cinemaclub.data.genre

class GenreRepository(
    private val dataSourceOnline: OnlineGenreDataSource,
    private val dataSourceLocal: LocalGenreDataSource
) {

    suspend fun getMovieGenreById(ids: List<Long>) : List<Genre> {

        var genres = dataSourceLocal.getMovieGenres()

        if (genres.isEmpty()) {
            genres = fetchDataOnline()
        }

        return genres.filter { it.id in ids }
    }

    private suspend fun fetchDataOnline() : List<Genre> {
        return dataSourceOnline.getMovieGenres()
            .also { dataSourceLocal.store(it) }
    }
}