package tech.kaomidev.cinemaclub.di.modules

import androidx.room.Room
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module
import tech.kaomidev.cinemaclub.database.DatabaseController
import tech.kaomidev.cinemaclub.database.datasource.LocalGenreDataSource
import tech.kaomidev.cinemaclub.domain.repository.GenreRepository
import tech.kaomidev.cinemaclub.domain.repository.MovieRepository

val domainModule = module {

    single {
        Room.databaseBuilder(androidContext(), DatabaseController::class.java, "app-db")
            .fallbackToDestructiveMigration()
            .build()
    }

    single { get<DatabaseController>().genreDao() }


    single {
        LocalGenreDataSource(
            get()
        )
    }

    single {
        GenreRepository(
            get(),
            get()
        )
    }

    single {
        MovieRepository(
            get(),
            get()
        )
    }
}