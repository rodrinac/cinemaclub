package tech.kaomidev.cinemaclub.network.dto
import com.google.gson.annotations.SerializedName

class MovieDto {
    var id: Long? = null    
    var title: String? = null

    @SerializedName("original_title")
    var originalTitle: String? = null

    @SerializedName("original_language")
    var originalLanguage: String? = null

    @SerializedName("backdrop_path")
    var backdropPath: String? = null

    @SerializedName("poster_path")
    var posterPath: String? = null

    @SerializedName("overview")
    var overview: String? = null

    @SerializedName("release_date")
    var releaseDate: String? = null

    @SerializedName("genre_ids")
    var genreIds: List<Long>? = null
    
    var adult: Boolean? = null   
    
    var popularity: Float? = null

    var genres: List<GenreDto>? = null

    @SerializedName("vote_count")
    var voteCount: Long? = null

    @SerializedName("vote_average")
    var voteAverage: Float? = null
}
