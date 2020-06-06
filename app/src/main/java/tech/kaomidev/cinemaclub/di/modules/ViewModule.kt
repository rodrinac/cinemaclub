package tech.kaomidev.cinemaclub.di.modules

import org.koin.android.viewmodel.dsl.viewModel
import org.koin.dsl.module
import tech.kaomidev.cinemaclub.ui.main.discovermovies.DiscoverMoviesViewModel
import tech.kaomidev.cinemaclub.ui.moviedetails.MovieDetailsViewModelProviderFactory
import tech.kaomidev.cinemaclub.ui.search.SearchViewModelProviderFactory

val viewModule = module {

    viewModel { DiscoverMoviesViewModel(get()) }

    single { MovieDetailsViewModelProviderFactory(get()) }

    single { SearchViewModelProviderFactory(get()) }
}