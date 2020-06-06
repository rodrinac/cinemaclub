package tech.kaomidev.cinemaclub.di.modules

import androidx.room.Room
import org.koin.android.ext.koin.androidContext
import org.koin.dsl.module
import tech.kaomidev.cinemaclub.data.genre.GenreRepository
import tech.kaomidev.cinemaclub.data.genre.LocalGenreDataSource
import tech.kaomidev.cinemaclub.data.genre.OnlineGenreDataSource
import tech.kaomidev.cinemaclub.data.movie.MovieRepository
import tech.kaomidev.cinemaclub.data.movie.OnlineMovieDataSource
import tech.kaomidev.cinemaclub.database.DatabaseController
import tech.kaomidev.cinemaclub.network.Tmdb

val domainModule = module {

    single { Tmdb.api }

    single {
        Room.databaseBuilder(androidContext(), DatabaseController::class.java, "app-db")
            .fallbackToDestructiveMigration()
            .build()
    }

    single { get<DatabaseController>().genreDao() }

    single { OnlineGenreDataSource(get()) }

    single { LocalGenreDataSource(get()) }

    single { OnlineMovieDataSource(get()) }

    single { GenreRepository(get(), get()) }

    single { MovieRepository(get(), get()) }
}