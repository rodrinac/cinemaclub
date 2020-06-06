package tech.kaomidev.cinemaclub.data.genre

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity
data class Genre(
    @PrimaryKey val id: Long?,
    val name: String?,
    var language: String? = null
)