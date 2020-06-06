package tech.kaomidev.cinemaclub.ui.moviedetails

import android.content.Context
import android.graphics.Color
import android.os.Bundle
import android.view.Menu
import android.view.MenuItem
import android.view.WindowManager
import android.widget.ArrayAdapter
import android.widget.ListAdapter
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Observer
import androidx.lifecycle.ViewModelProvider
import com.google.android.material.snackbar.Snackbar
import kotlinx.android.synthetic.main.activity_movie_details.*
import org.koin.android.ext.android.inject
import tech.kaomidev.cinemaclub.R
import tech.kaomidev.cinemaclub.data.genre.Genre
import tech.kaomidev.cinemaclub.data.movie.Movie
import tech.kaomidev.cinemaclub.utils.*

class MovieDetailsActivity : AppCompatActivity() {
    private var starred = false

    private val viewModelProviderFactory: MovieDetailsViewModelProviderFactory by inject()

    private val movieId: Long by getExtraLong(MOVIE_ARG)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )

        setContentView(R.layout.activity_movie_details)
        setSupportActionBar(toolbar)

        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        viewModelProviderFactory.movieId = movieId

        val viewModel = ViewModelProvider(this, viewModelProviderFactory)
            .get(MovieDetailsViewModel::class.java)

        viewModel.movie.observe(this, Observer { handleMovie(it) })
    }

    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        menuInflater.inflate(R.menu.menu_movie_details, menu)

        menu?.findItem(R.id.action_favorite)?.let { menuItem ->

            if (starred) {
                menuItem.setIcon(R.drawable.ic_turned_in_black_24dp)
            } else {
                menuItem.setIcon(R.drawable.ic_turned_in_not_black_24dp)
            }

            menuItem.setIconTint(Color.WHITE)
        }

        return true
    }

    override fun onOptionsItemSelected(item: MenuItem): Boolean = when (item.itemId) {
        android.R.id.home -> onBackPressed().let { true }
        R.id.action_favorite -> handleFavoriteClick().let { true }
        else -> super.onOptionsItemSelected(item)
    }

    private fun handleFavoriteClick() {

        starred = !starred

        val message = if (starred) {
            getString(R.string.movie_saved)
        } else {
            getString(R.string.movie_unsaved)
        }

        Snackbar.make(fab, message, Snackbar.LENGTH_LONG)
            .setAction("Action", null).show()

        invalidateOptionsMenu()

    }

    private fun handleMovie(movie: Movie) {

        supportActionBar?.title =  movie.originalTitle

        movie.backdropPath?.let {
            headerView.loadUrl("https://image.tmdb.org/t/p/w500/$it", true)
        }

        movieTitleView.text = movie.title ?: movie.originalTitle

        voteInfoView.text = movie.run {
            val localStringDate = releaseDate?.toLocalDate()?.year

            "$voteAverage/10 \u2022 $localStringDate"
        }

        movieSynopsesView.text = movie.overview ?: getString(R.string.empty_info)

        ratingBar.rating = movie.voteAverage?.let { it / 2f } ?: 0f

        movie.genres?.let { setupChipGroup(it) }

        fab.setOnClickListener { }
    }

    private fun setupChipGroup(genres: List<Genre>) {
        genres.take(3).forEach { genre -> movieGenresView.addView(chipOf(this, genre.name!!)) }

        if (genres.size > 3) {
            val chipAll = chipOf(this, "•••")

            chipAll.setOnClickListener {
                val builder = AlertDialog.Builder(this)

                builder.setAdapter(makeGenreAdapter(genres)) { dialog, _ -> dialog.dismiss() }

                builder.create().show()
            }

            movieGenresView.addView(chipAll)
        }
    }

    private fun makeGenreAdapter(genres: List<Genre>): ListAdapter {
        return ArrayAdapter(this, R.layout.genre_item, genres.map { it.name!! })
    }

    companion object {
        private const val MOVIE_ARG = "tech.kaomidev.cinemaclub.ui.moviedetails.MovieDetailsActivity.MovieKey"

        fun start(context: Context, movie: Movie) {
            val intent = context.getIntent<MovieDetailsActivity>()
                .apply { putExtra(MOVIE_ARG, movie.id!!) }

            context.startActivity(intent)
        }
    }
}
