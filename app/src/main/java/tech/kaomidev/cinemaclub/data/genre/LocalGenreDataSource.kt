package tech.kaomidev.cinemaclub.data.genre

import tech.kaomidev.cinemaclub.database.GenreDao
import tech.kaomidev.cinemaclub.utils.systemLocale

class LocalGenreDataSource(private val genreDao: GenreDao) : GenreDataSource {

    suspend fun store(genres: List<Genre>): List<Long> {
        val languageTag = systemLocale.toLanguageTag()

        genres.forEach { it.language = languageTag }

        return genreDao.save(genres)
    }

    override suspend fun getMovieGenres(): List<Genre> {
        return genreDao.getAllByLanguage(systemLocale.toLanguageTag()) ?: listOf()
    }

}