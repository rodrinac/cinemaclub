package tech.kaomidev.cinemaclub.ui.shared

import androidx.recyclerview.widget.DiffUtil
import tech.kaomidev.cinemaclub.domain.entity.Movie

object MovieItemDiffCallback: DiffUtil.ItemCallback<Movie>() {
    override fun areItemsTheSame(oldItem: Movie, newItem: Movie): Boolean {
        return oldItem.id == newItem.id
    }

    override fun areContentsTheSame(oldItem: Movie, newItem: Movie): Boolean {
        return oldItem == newItem
    }

}