package tech.kaomidev.cinemaclub.ui.main.discovermovies

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.Observer
import androidx.recyclerview.widget.GridLayoutManager
import kotlinx.android.synthetic.main.fragment_discover_movies.*
import org.koin.android.ext.android.inject
import tech.kaomidev.cinemaclub.R
import tech.kaomidev.cinemaclub.data.movie.Movie
import tech.kaomidev.cinemaclub.ui.moviedetails.MovieDetailsActivity
import tech.kaomidev.cinemaclub.ui.shared.GridSpacingItemDecoration
import tech.kaomidev.cinemaclub.ui.shared.adapters.PortraitMovieListAdapter
import tech.kaomidev.cinemaclub.utils.Units

class DiscoverMoviesFragment : Fragment() {

    private val viewModel: DiscoverMoviesViewModel by inject()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_discover_movies, container, false)
    }

    override fun onActivityCreated(savedInstanceState: Bundle?) {
        super.onActivityCreated(savedInstanceState)

        discoverMoviesRecyclerView.layoutManager = GridLayoutManager(this.context, 2)
        discoverMoviesRecyclerView.addItemDecoration(GridSpacingItemDecoration(Units.dpToPixels(4).toInt()))
        discoverMoviesRecyclerView.adapter = makeListAdapter()
    }

    private fun makeListAdapter(): PortraitMovieListAdapter {
        val listAdapter = PortraitMovieListAdapter(this::showMovieDetails)

        viewModel.moviePagedList.observe(viewLifecycleOwner, Observer { listAdapter.submitList(it) })

        return listAdapter
    }

    private fun showMovieDetails(movie: Movie) {
        MovieDetailsActivity.start(this.context!!, movie)
    }

    companion object {
        fun newInstance() = DiscoverMoviesFragment()
    }

}
