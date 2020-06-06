package tech.kaomidev.cinemaclub.ui.shared.adapters

import android.view.View
import android.view.ViewGroup
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.RatingBar
import android.widget.TextView
import androidx.paging.PagedListAdapter
import androidx.recyclerview.widget.RecyclerView
import kotlinx.android.synthetic.main.movie_item_landscape.view.*
import kotlinx.android.synthetic.main.movie_item_portrait.view.poster
import kotlinx.android.synthetic.main.movie_item_portrait.view.title
import tech.kaomidev.cinemaclub.R
import tech.kaomidev.cinemaclub.data.movie.Movie
import tech.kaomidev.cinemaclub.ui.shared.MovieItemDiffCallback
import tech.kaomidev.cinemaclub.utils.inflateView
import tech.kaomidev.cinemaclub.utils.loadUrl
import tech.kaomidev.cinemaclub.utils.localDateFormatter
import tech.kaomidev.cinemaclub.utils.toLocalDate

class LandscapeMovieListAdapter(private val onClicked: (Movie) -> Unit)
    : PagedListAdapter<Movie, LandscapeMovieListAdapter.ViewHolder>(MovieItemDiffCallback) {

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        return ViewHolder(parent.inflateView(R.layout.movie_item_landscape))
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = getItem(position) ?: return

        holder.movieTitle.text = item.title

        holder.movieGenres.text = item.genres?.take(2)?.map { it.name }?.joinToString()
        holder.movieRating.rating = item.voteAverage?.let { it / 2f } ?: 0f
        holder.actionButton.setOnClickListener { onClicked.invoke(item) }

        item.posterPath?.let {
            holder.moviePoster.loadUrl(path = "https://image.tmdb.org/t/p/w342/$it", radius = 6)
        }

        holder.movieLocaleAndYear.text = item.releaseDate?.toLocalDate()?.format(localDateFormatter)
    }

    class ViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        internal val moviePoster : ImageView by lazy { itemView.poster }
        internal val movieTitle : TextView by lazy { itemView.title }
        internal val movieGenres : TextView by lazy { itemView.genres }
        internal val movieLocaleAndYear : TextView by lazy { itemView.localeAndYear }
        internal val movieRating : RatingBar by lazy { itemView.rating }
        internal val actionButton : ImageButton by lazy { itemView.actionButton }
    }
}