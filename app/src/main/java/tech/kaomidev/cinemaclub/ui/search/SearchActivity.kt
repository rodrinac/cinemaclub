package tech.kaomidev.cinemaclub.ui.search

import android.app.SearchManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.Menu
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SearchView
import androidx.lifecycle.Observer
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import kotlinx.android.synthetic.main.activity_search.*
import org.koin.android.ext.android.inject
import tech.kaomidev.cinemaclub.R
import tech.kaomidev.cinemaclub.domain.entity.Movie
import tech.kaomidev.cinemaclub.ui.moviedetails.MovieDetailsActivity
import tech.kaomidev.cinemaclub.ui.shared.GridSpacingItemDecoration
import tech.kaomidev.cinemaclub.ui.shared.adapters.LandscapeMovieListAdapter
import tech.kaomidev.cinemaclub.utils.Units

class SearchActivity : AppCompatActivity() {

    private lateinit var viewModel: SearchViewModel

    private val viewModelProviderFactory: SearchViewModelProviderFactory by inject()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_search)
        setSupportActionBar(toolbar)

        handleIntent(intent)
    }

    override fun onCreateOptionsMenu(menu: Menu?): Boolean {
        menuInflater.inflate(R.menu.menu_search, menu)

        val searchManager = getSystemService(Context.SEARCH_SERVICE) as SearchManager
        val searchView = menu?.findItem(R.id.action_search)?.actionView as SearchView

        searchView.setSearchableInfo(searchManager.getSearchableInfo(componentName))

        return true
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)

        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent) {

        if (Intent.ACTION_SEARCH == intent.action) {
            val query = intent.getStringExtra(SearchManager.QUERY)

            searchResultView.text = getString(R.string.search_result, query)
            viewModelProviderFactory.query = query

            viewModel = ViewModelProvider(this, viewModelProviderFactory)
                .get(SearchViewModel::class.java)

            searchMoviesRecyclerView.layoutManager = LinearLayoutManager(this)
            searchMoviesRecyclerView.addItemDecoration(GridSpacingItemDecoration(Units.dpToPixels(4).toInt()))
            searchMoviesRecyclerView.adapter = makeListAdapter()
        }
    }

    private fun makeListAdapter(): LandscapeMovieListAdapter {
        val listAdapter = LandscapeMovieListAdapter(this::showMovieDetails)

        viewModel.moviePagedList.observe(this, Observer { listAdapter.submitList(it) })

        return listAdapter
    }

    private fun showMovieDetails(movie: Movie) {
        MovieDetailsActivity.start(this, movie)
    }
}
