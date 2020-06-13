package tech.kaomidev.cinemaclub.di.modules

import androidx.room.Room
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module
import tech.kaomidev.cinemaclub.database.DatabaseController
import tech.kaomidev.cinemaclub.database.datasource.LocalGenreDataSource
import tech.kaomidev.cinemaclub.domain.repository.GenreRepository
import tech.kaomidev.cinemaclub.domain.repository.MovieRepository
import tech.kaomidev.cinemaclub.network.Tmdb
import tech.kaomidev.cinemaclub.network.datasource.RemoteGenreDataSource
import tech.kaomidev.cinemaclub.network.datasource.RemoteMovieDataSource

val domainModule = module {

    single { Tmdb.api }

    single {
        Room.databaseBuilder(androidContext(), DatabaseController::class.java, "app-db")
            .fallbackToDestructiveMigration()
            .build()
    }

    single { get<DatabaseController>().genreDao() }

    single {
        RemoteGenreDataSource(
            get()
        )
    }

    single {
        LocalGenreDataSource(
            get()
        )
    }

    single {
        RemoteMovieDataSource(
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