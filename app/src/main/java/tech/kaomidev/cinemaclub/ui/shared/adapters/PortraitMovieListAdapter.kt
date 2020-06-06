package tech.kaomidev.cinemaclub.ui.shared.adapters

import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.paging.PagedListAdapter
import androidx.recyclerview.widget.RecyclerView
import kotlinx.android.synthetic.main.movie_item_portrait.view.*
import tech.kaomidev.cinemaclub.R
import tech.kaomidev.cinemaclub.data.movie.Movie
import tech.kaomidev.cinemaclub.ui.shared.MovieItemDiffCallback
import tech.kaomidev.cinemaclub.utils.inflateView
import tech.kaomidev.cinemaclub.utils.loadUrl

class PortraitMovieListAdapter(private val onClicked: (Movie) -> Unit)
    : PagedListAdapter<Movie, PortraitMovieListAdapter.ViewHolder>(MovieItemDiffCallback) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        return ViewHolder(
            parent.inflateView(R.layout.movie_item_portrait)
        )
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = getItem(position) ?: return

        holder.movieTitle.text = item.title

        item.posterPath?.let {
            holder.moviePoster.loadUrl("https://image.tmdb.org/t/p/w342/$it")
        }

        holder.itemView.setOnClickListener { onClicked.invoke(item) }
    }

    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        internal val moviePoster : ImageView by lazy { itemView.poster }
        internal val movieTitle : TextView by lazy { itemView.title }
    }
}