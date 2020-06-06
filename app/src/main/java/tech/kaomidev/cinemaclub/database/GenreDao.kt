package tech.kaomidev.cinemaclub.database

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import tech.kaomidev.cinemaclub.data.genre.Genre

@Dao
interface GenreDao {

    @Insert
    suspend fun save(genres: List<Genre>): List<Long>

    @Query("SELECT * FROM Genre WHERE language = :languageTag")
    suspend fun getAllByLanguage(languageTag: String): List<Genre>?
}