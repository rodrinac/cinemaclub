package tech.kaomidev.cinemaclub.utils

import android.util.Log
import java.time.LocalDate

fun String.toLocalDate() = try {
        LocalDate.parse(this)
    } catch (ex: Exception) {
        Log.e("String\$LocalDate", ex.message)
        null
    }
